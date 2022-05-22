import { Account, Algodv2 } from 'algosdk'
import fs from 'fs'
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

if (!fs.existsSync('.env') && !process.env.ALGOD_SERVER) {
  console.error('Copy .env.sample to .env before starting the application.')
  process.exit(1)
}
;(async () => {
  try {
    const client = await getAlgoClient()
    const creatorAccount = await getAccount(client, CREATOR_ACCOUNT)

    // todo: Get HashLips metadata
    const project = {
      name: 'PROJECT',
    }
    const nftsToMint: NFT[] = []

    console.log(`Minting NFTs for ${project.name}`)

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

interface NFT {
  dna: string
  name: string
  imageUrl: string
  externalUrl?: string
  description?: string
  traits?: Record<string, string>
}

async function getAlgorandNFTTransaction(
  client: Algodv2,
  creatorAccount: Account,
  nft: NFT,
  unitName: string,
  mutableMetadata: boolean,
  note?: string
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
    note: note,
  }

  // Create NFT
  const { transaction } = await createNonFungibleToken(mintParameters, client)
  return transaction
}
