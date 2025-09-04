import { GlobalRpcProviders } from '../../../../lib/rpc/GlobalRpcProviders'
import Sinon, { SinonSandbox } from 'sinon'

const cleanUp = () => {
  GlobalRpcProviders['UNI_RPC_PROVIDERS'] = null
  GlobalRpcProviders['SINGLE_RPC_PROVIDERS'] = null
}

describe('GlobalRpcProviders', () => {
  let sandbox: SinonSandbox

  beforeEach(() => {
    sandbox = Sinon.createSandbox()
  })

  afterEach(() => {
    sandbox.restore()
    cleanUp()
  })



})
