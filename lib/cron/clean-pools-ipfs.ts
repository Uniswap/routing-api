import pinataSDK from '@pinata/sdk'
import { EventBridgeEvent, ScheduledHandler } from 'aws-lambda'
import { default as bunyan, default as Logger } from 'bunyan'

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

const START_MONTHS_AGO = 2
const END_MONTHS_AGO = 1

const PAGE_SIZE = 1000

const pinata = pinataSDK(process.env.PINATA_API_KEY!, process.env.PINATA_API_SECRET!)

const handler: ScheduledHandler = async (event: EventBridgeEvent<string, void>) => {
  const log: Logger = bunyan.createLogger({
    name: 'CleanIPFSPoolCacheLambda',
    serializers: bunyan.stdSerializers,
    level: 'info',
    requestId: event.id,
  })

  const now = new Date()
  const startDate = new Date(now.getFullYear(), now.getMonth() - START_MONTHS_AGO, now.getDate())
  const endDate = new Date(now.getFullYear(), now.getMonth() - END_MONTHS_AGO, now.getDate())

  let unpinned = 0
  let count = 1

  while (unpinned < count) {
    const filters = {
      status: 'pinned',
      pinStart: startDate.toISOString(),
      pinEnd: endDate.toISOString(),
      // retrieve only the pool data (called temp for now)
      metadata: { name: 'temp', keyvalues: {} },
      pageLimit: PAGE_SIZE,
      // Do not need to change offset, getting new data from pinList each time.
      pageOffset: 0,
    }

    let result
    try {
      result = await pinata.pinList(filters)
      // 3 requests per second is max allowed by Pinata API. We ensure we do not exceed 2 requests per second to give a buffer.
      await delay(500)
    } catch (err) {
      log.error({ err }, `Error on pinList. ${JSON.stringify(err)}. Waiting one minute.`)
      await delay(60000)
      continue
    }

    if (count == 1) {
      // set count
      count = result.count
      log.info(
        { startDate, endDate },
        `Overall pins count between ${startDate.toDateString()} and ${endDate.toDateString()}: ${count}`
      )
    }

    for (let i = 0; i < result.rows.length; i += 1) {
      const { ipfs_pin_hash: hash, date_pinned: datePinned } = result.rows[i]

      try {
        const response = await pinata.unpin(hash)

        // 3 requests per second is max allowed by Pinata API. We ensure we do not exceed 2 requests per second to give a buffer.
        await delay(500)

        unpinned += 1
        log.info({ response, hash }, `Unpinned: ${hash} pinned at ${datePinned}`)
      } catch (err: any) {
        if (err.reason == 'CURRENT_USER_HAS_NOT_PINNED_CID') {
          log.error({ err }, `Error ${err.reason} - Unpinned ${unpinned} so far. Skipping current pin`)
        } else {
          log.error({ err }, `Error ${err.reason} - Unpinned ${unpinned} so far. Waiting one minute`)
          await delay(60000)
          // set i back one since it was an unsuccessful unpin
          i -= 1
        }
      }
      log.info(`Unpinned ${unpinned} out of ${result.rows.length} from current page.`)
    }
  }

  log.info(`Unpinned all ${unpinned} pins out of ${count} in the date range.`)
}
module.exports = { handler }
