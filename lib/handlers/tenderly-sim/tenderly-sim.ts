import { log } from "@uniswap/smart-order-router";
import axios from "axios";
//import { fork } from "child_process";
import * as dotenv from "dotenv";
import { BigNumber, ethers, providers } from "ethers";
import { JsonRpcProvider, TransactionReceipt } from "@ethersproject/providers"

// Swap Router Contract
const V3_ROUTER2_ADDRESS = "0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45"
const V3_ROUTER_ABI = require('../../abis/v3_router2_abi.json')

// API for GET+DELETE
export const TENDERLY_FORK_API_URL = (FORK_ID:string):string=> `https://rpc.tenderly.co/fork/${FORK_ID}`

// API For POST
export const POST_TENDERLY_FORK_API_URL = (TENDERLY_BASE_URL:string, TENDERLY_USER:string, TENDERLY_PROJECT:string)=>`${TENDERLY_BASE_URL}/api/v1/account/${TENDERLY_USER}/project/${TENDERLY_PROJECT}/fork`

dotenv.config();

export interface ISimulator {
    simulateTx: (chainId:number, hexData: string, fromAddress:string, blockNumber: number)=>Promise<TransactionReceipt>
}
export class TenderlyProvider implements ISimulator {
    TENDERLY_BASE_URL:string
    TENDERLY_USER:string
    TENDERLY_PROJECT:string
    TENDERLY_ACCESS_KEY:string
    CACHED_FORKS = new Map<{ chainId: number; blockNumber: number }, { fork: JsonRpcProvider; contract: ethers.Contract }>()
    constructor(TENDERLY_BASE_URL:string, TENDERLY_USER:string, TENDERLY_PROJECT:string, TENDERLY_ACCESS_KEY:string) {
        this.TENDERLY_BASE_URL = TENDERLY_BASE_URL
        this.TENDERLY_USER = TENDERLY_USER
        this.TENDERLY_PROJECT = TENDERLY_PROJECT
        this,TENDERLY_ACCESS_KEY = TENDERLY_ACCESS_KEY
    }
    public async simulateTx(chainId:number, hexData:string, fromAddress:string, blockNumber:number):Promise<TransactionReceipt> {
      log.info("HERE")
      const {
        fork,
        contract, //V3 router contract instance
      } = await this.getFork({chainId, blockNumber})
      log.info({provider:fork,contract:contract},"GOT FORK")

      const transaction = {
        data: hexData,
        to: contract.address,
        value: BigNumber.from(0),
        from: fromAddress,
        gasPrice: ethers.utils.hexValue(1),
        gasLimit: ethers.utils.hexValue(30000000),
        type: 1,
      }
  
      const transactionResponse: providers.TransactionResponse = await fork.getSigner(fromAddress).sendTransaction(transaction)
      const txReceipt = await transactionResponse.wait()
      return txReceipt
      
      /*
      const unsignedTx = await contract.populateTransaction[`multicall(uint256,bytes[])`](Date.now()+1000*60*3 as number,hexData)
      log.info({provider:fork,contract:contract},"GOT CONTRACT")
      const txParams = [{
        network_id:chainId.toString(),
        to:contract.address,
        from:'0x63946551716781C32f0269F87DC08521818b6292',
        data:unsignedTx.data,
        gas: ethers.utils.hexValue(30000000),
        gasPrice: ethers.utils.hexValue(1),
        value: ethers.utils.hexValue(0)
      }]
      const txHash = await fork.send('eth_sendTransaction', txParams)
      return fork.getTransactionReceipt(txHash)
      */
    }
    private async getFork(params: {chainId:number, blockNumber:number}):Promise<{fork:JsonRpcProvider, contract:ethers.Contract}> {
      if(!this.CACHED_FORKS.has(params)) {
        // Assume Fork does not yet exist
        const fork = await this.createFork(params.blockNumber)
        try {
          const v3_router2 = new ethers.Contract(
            V3_ROUTER2_ADDRESS,
            V3_ROUTER_ABI.abi,
            fork
          );
          this.CACHED_FORKS.set(params, {fork:fork, contract:v3_router2})
        } catch (err) {
            log.error(err)
            throw new Error("failed to initialize v3 router contract")
        }
      }
      return this.CACHED_FORKS.get(params)!
    }
    private createFork(blockNumber:number):Promise<JsonRpcProvider> {
      const opts = {
        headers: {
            'X-Access-Key': 'trIEjRmH141TMqq-rl-wmc0oVn9hqeOP',
        }
      }
      const body = {
        "network_id": "1",
        "block_number": blockNumber,
      }
      return axios
          .post(POST_TENDERLY_FORK_API_URL(this.TENDERLY_BASE_URL, this.TENDERLY_USER, this.TENDERLY_PROJECT), body, opts)
          .then(resp=>new ethers.providers.JsonRpcProvider(`https://rpc.tenderly.co/fork/${resp.data.simulation_fork.id}`))
          .catch(err=>{throw new Error(err)})
    }
  }
