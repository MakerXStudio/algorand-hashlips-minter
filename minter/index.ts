import { Account, Algodv2 } from 'algosdk'
import fsSync from 'fs'
import fs from 'fs/promises'
import path from 'path'
import { getFilesFromPath, Web3Storage } from 'web3.storage'
import { CREATOR_ACCOUNT } from './constants'
import { getAccount } from './functions/account'
import { chunkArray } from './functions/array'
import { Arc69Metadata, CreateAssetParamsBase, createNonFungibleToken, MediaType } from './functions/asset'
import { getAlgoClient } from './functions/client'
import { handleError } from './functions/error'
import { AssetResult } from './functions/search'
import { sendGroupOfTransactions } from './functions/transaction'

/*********************************/
/**** NFT metadata - edit this */
/*********************************/
const mutableMetadata = false
const unitName = 'UNIT'
const mediaType = MediaType.Image
/**** End of NFT metadata ******/
/*********************************/

if (!fsSync.existsSync('.env') && (!process.env.ALGOD_SERVER || !process.env.WEB3_STORAGE_API_TOKEN)) {
  console.error('Copy .env.sample to .env and fill in before starting the application.')
  process.exit(1)
}
;(async () => {
  try {
    const client = await getAlgoClient()
    const storage = new Web3Storage({ token: process.env.WEB3_STORAGE_API_TOKEN! })
    const creatorAccount = await getAccount(client, CREATOR_ACCOUNT)

    // Upload images to IPFS
    const cid = await uploadToIPFS(storage, '../hashlips-output/images/')

    // Parse HashLips metadata output
    const nftsToMint: NFT[] = []
    const hashLipsOutput = await fs.readdir(path.join(__dirname, '../hashlips-output/json'))
    for (let metadataFile of hashLipsOutput) {
      if (metadataFile === '_metadata.json') {
        continue
      }

      const metadataJSON = await fs.readFile(path.join(__dirname, '../hashlips-output/json', metadataFile))
      const metadata = JSON.parse(metadataJSON.toString('utf-8')) as HashLipsMetadata

      const traits: Record<string, string> = {}
      if (metadata.attributes) {
        metadata.attributes.forEach((a) => {
          traits[a.trait_type] = a.value
        })
      }

      nftsToMint.push({
        dna: metadata.dna,
        imageUrl: metadata.image.replace('ipfs://NewUriToReplace/', `ipfs://${cid}/images/`),
        name: metadata.name,
        description: metadata.description,
        traits: traits,
      })
    }

    console.log(`Found ${nftsToMint.length} HashLips generated NFTs`)

    const accountInformation = await client.accountInformation(creatorAccount.addr).do()
    const existingAlgorandNFTs = (accountInformation['created-assets'] as AssetResult[]).filter(
      (a) => a.params['unit-name'] === unitName
    )

    console.log(`Found ${existingAlgorandNFTs.length} existing NFTs already minted on Algorand`)

    const diff = nftsToMint.filter(
      (nft) => existingAlgorandNFTs.filter((algoNFT) => algoNFT.params.name === nft.name).length === 0
    )
    console.log(`Determined there are ${diff.length} NFTs left to mint`)

    console.log(`Minting in batches of 16 at a time`)
    const batches = chunkArray(diff, 16)
    for (let batch of batches) {
      const txns = await Promise.all(
        batch.map(
          async (nft) => await getAlgorandNFTTransaction(client, creatorAccount, nft, unitName, mutableMetadata)
        )
      )

      const result = await sendGroupOfTransactions(
        client,
        txns.map((txn) => ({
          transaction: txn,
          signer: creatorAccount,
        }))
      )

      console.log(
        `Submitted ${batch.length} creation transactions with transaction group ID ${result.txId} in round ${
          result.confirmation?.['confirmed-round']
        } for NFTs: ${batch.map((b) => b.name).join(', ')}`
      )
    }

    console.log('---')
    console.log('---')
    console.log('---')
    console.log('---')

    console.log(
      `All minted! If you are minting against MainNet check out https://www.nftexplorer.app/collection?creator=${creatorAccount.addr} to see your NFT collection.`
    )
  } catch (error) {
    handleError(error)
    process.exit(1)
  }
})()
interface HashLipsMetadataTrait {
  trait_type: string
  value: string
}

interface HashLipsMetadata {
  compiler: string
  date: number
  description: string
  dna: string
  edition: number
  image: string
  name: string
  attributes: HashLipsMetadataTrait[]
}

interface NFT {
  dna: string
  name: string
  imageUrl: string
  externalUrl?: string
  description?: string
  traits?: Record<string, string>
}

async function uploadToIPFS(storage: Web3Storage, filePath: string) {
  const fileRef = await getFilesFromPath(filePath)
  return await storage.put(fileRef)
}

async function getAlgorandNFTTransaction(
  client: Algodv2,
  creatorAccount: Account,
  nft: NFT,
  unitName: string,
  mutableMetadata: boolean
) {
  let mintParameters: CreateAssetParamsBase
  mintParameters = {
    assetName: nft.name,
    unitName: unitName,
    creator: creatorAccount,
    managerAddress: mutableMetadata ? creatorAccount.addr : undefined,
    url: nft.imageUrl,
    arc69Metadata: {
      ...({
        mediaType: mediaType,
        description: nft.description,
        externalUrl: nft.externalUrl,
        properties: nft.traits,
      } as Arc69Metadata),
      ...{ dna: nft.dna },
    } as any,
    skipSending: true,
  }

  // Create NFT
  const { transaction } = await createNonFungibleToken(mintParameters, client)
  return transaction
}
