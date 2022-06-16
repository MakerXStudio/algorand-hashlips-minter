import algosdk from 'algosdk'
import readline from 'readline'
import { getAccountFromMnemonic } from '../functions/account'
import { getAlgoClient } from '../functions/client'
import { handleError } from '../functions/error'
import { AssetResult } from '../functions/search'
import { sendGroupOfTransactions, TransactionToSign } from '../functions/transaction'

function* chunks<T>(arr: T[], n: number): Generator<T[], void> {
  for (let i = 0; i < arr.length; i += n) {
    yield arr.slice(i, i + n)
  }
}

const MaxTxGroupSize = 16

const transfer = async () => {
  const client = await getAlgoClient()

  const readLine = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
  })

  try {
    console.log()
    console.log('========================')
    console.log('TRANSFER ALGORAND ASSETS')
    console.log('========================')

    console.log(
      'This script allows you to transfer all or a subset of assets from one account to another (including opt-in).'
    )

    console.log(
      'This is particularly useful when moving a collection of assets between random shuffle accounts e.g. via Rand Gallery or AlgoxNFT.'
    )

    console.log()

    const receiverMnemonic = await new Promise<string>((resolve, _) =>
      readLine.question('What is the mnemonic of the receiver account (ensure nobody can see it!)? ', (answer) =>
        resolve(answer)
      )
    )
    const receiverAccount = await getAccountFromMnemonic(receiverMnemonic)

    const senderMnemonic = await new Promise<string>((resolve, _) =>
      readLine.question('What is the mnemonic of the sender account (ensure nobody can see it!)? ', (answer) =>
        resolve(answer)
      )
    )
    const senderAccount = await getAccountFromMnemonic(senderMnemonic)

    const assetIds = await new Promise<number[]>((resolve, _) =>
      readLine.question('What asset ID(s) should be transferred (comma-delimited, blank = all)? ', (answer) =>
        resolve(answer ? answer.split(',').map((id) => parseInt(id)) : [])
      )
    )

    if (assetIds.length === 0) {
      const account = await client.accountInformation(senderAccount.addr).do()
      const assets = account['assets']
      assetIds.push(...assets.filter((a: any) => a.amount > 0).map((a: any) => a['asset-id']))
    }

    const assets = await Promise.all(
      assetIds.slice(0, 4).map(async (aid) => (await client.getAssetByID(aid).do()) as AssetResult)
    )

    console.log()
    console.log('========================')
    console.log('WARNING')
    console.log('========================')

    console.warn(`About to transfer ${assetIds.length} assets from ${senderAccount.addr} to ${receiverAccount.addr}!`)
    console.log(
      `You will need at least ${assetIds.length * 0.001} ALGO in sender and ${
        assetIds.length * 0.102
      } ALGO in receiver.`
    )
    console.log(`Preview of first 4 assets:\n ${JSON.stringify(assets, null, 4)}`)

    const transfer = await new Promise<boolean>((resolve, _) =>
      readLine.question('Are you sure (Y/n)? ', (answer) => resolve(answer === 'Y'))
    )
    if (!transfer) {
      throw new Error('Transfer not confirmed, exiting')
    }

    const suggestedParams = await client.getTransactionParams().do()
    for (let assetIdGroup of chunks(assetIds, Math.floor(MaxTxGroupSize / 2))) {
      try {
        const txnGrp: TransactionToSign[] = assetIdGroup.flatMap((assetId) => [
          // opt-in
          {
            transaction: algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
              assetIndex: assetId,
              amount: 0,
              from: receiverAccount.addr,
              to: receiverAccount.addr,
              rekeyTo: undefined,
              revocationTarget: undefined,
              suggestedParams,
            }),
            signer: receiverAccount,
          },
          // transfer
          {
            transaction: algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
              assetIndex: assetId,
              amount: 1,
              from: senderAccount.addr,
              to: receiverAccount.addr,
              rekeyTo: undefined,
              revocationTarget: undefined,
              suggestedParams,
            }),
            signer: senderAccount,
          },
        ])

        const { txId, confirmation } = await sendGroupOfTransactions(client, txnGrp)

        console.log(
          `Successfully transferred assets ${assetIdGroup.join(', ')} with transaction ${txId} and round ${
            confirmation!['confirmed-round']
          }.`
        )
      } catch (e) {
        console.error(e)
      }
    }
  } finally {
    readLine.close()
  }
}

transfer().catch((error) => {
  handleError(error)

  process.exit(1)
})
