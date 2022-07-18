import { log } from "@uniswap/smart-order-router";
import axios from "axios";
//import { fork } from "child_process";
import * as dotenv from "dotenv";
import { BigNumber, ethers, providers } from "ethers";
import { JsonRpcProvider, TransactionReceipt } from "@ethersproject/providers"

// Swap Router Contract
const V3_ROUTER2_ADDRESS = "0x68b3465833fb72A70ecDF485E0e4C7bD8665Fc45"

// API for GET+DELETE
export const TENDERLY_FORK_API_URL = (FORK_ID:string):string=> `https://rpc.tenderly.co/fork/${FORK_ID}`

// API For POST
export const POST_TENDERLY_FORK_API_URL = (TENDERLY_BASE_URL:string, TENDERLY_USER:string, TENDERLY_PROJECT:string)=>`${TENDERLY_BASE_URL}/api/v1/account/${TENDERLY_USER}/project/${TENDERLY_PROJECT}/fork`

export const APPROVE_TOKEN_FOR_TRANSFER = "0x095ea7b300000000000000000000000068b3465833fb72a70ecdf485e0e4c7bd8665fc45ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff"

dotenv.config();

export interface ISimulator {
    simulateTx: (chainId:number, hexData: string, tokenInAddress:string, fromAddress:string, blockNumber: number)=>Promise<TransactionReceipt>
}
export class TenderlyProvider implements ISimulator {
    TENDERLY_BASE_URL:string
    TENDERLY_USER:string
    TENDERLY_PROJECT:string
    TENDERLY_ACCESS_KEY:string
    CACHED_FORKS = new Map<{ chainId: number; blockNumber: number }, JsonRpcProvider>()
    constructor(TENDERLY_BASE_URL:string, TENDERLY_USER:string, TENDERLY_PROJECT:string, TENDERLY_ACCESS_KEY:string) {
        this.TENDERLY_BASE_URL = TENDERLY_BASE_URL
        this.TENDERLY_USER = TENDERLY_USER
        this.TENDERLY_PROJECT = TENDERLY_PROJECT
        this.TENDERLY_ACCESS_KEY = TENDERLY_ACCESS_KEY
    }
    public async simulateTx(chainId:number, hexData:string, tokenInAddress:string, fromAddress:string, blockNumber:number):Promise<TransactionReceipt> {
      log.info(
        {
          hexData:hexData,
          fromAddress:fromAddress,
          chainId:chainId,
          tokenInAddress:tokenInAddress,
          blockNumber:blockNumber
        },
        "Simulating transaction via Tenderly"
      )
      const fork = await this.getFork({chainId, blockNumber})

      const approve = {
        data: APPROVE_TOKEN_FOR_TRANSFER,
        to: tokenInAddress,
        value: BigNumber.from(0),
        from: fromAddress,
        gasPrice: ethers.utils.hexValue(1),
        gasLimit: ethers.utils.hexValue(30000000),
        type: 1,
      }

      const swap = {
        data: hexData,
        to: V3_ROUTER2_ADDRESS,
        value: BigNumber.from(0),
        from: fromAddress,
        gasPrice: ethers.utils.hexValue(1),
        gasLimit: ethers.utils.hexValue(30000000),
        type: 1,
      }
  
      const approveResponse: providers.TransactionResponse = await fork.getSigner(fromAddress).sendTransaction(approve)
      approveResponse.wait()

      const swapResponse: providers.TransactionResponse = await fork.getSigner(fromAddress).sendTransaction(swap)
      const swapReceipt = await swapResponse.wait()
      
      return swapReceipt
    }
  
    private async getFork(params: {chainId:number, blockNumber:number}):Promise<JsonRpcProvider> {
      log.info({params:params}, "Getting Tenderly Fork")
      // Assume Fork of the block does not yet exist in our tenderly project
      // TODO implement storage and management of tenderly forks
      const fork = await this.createFork(params)
      return fork
    }
    private createFork(params: {chainId:number, blockNumber:number}):Promise<JsonRpcProvider> {
      log.info({params:params}, "Creating Tenderly Fork")
      const opts = {
        headers: {
            'X-Access-Key': this.TENDERLY_ACCESS_KEY,
        }
      }
      const body = {
        "network_id": params.chainId,
        "block_number": params.blockNumber,
        "simulation_type": "quick",
        "save_if_fails": true,
      }
      return axios
          .post(POST_TENDERLY_FORK_API_URL(this.TENDERLY_BASE_URL, this.TENDERLY_USER, this.TENDERLY_PROJECT), body, opts)
          .then(resp=>new ethers.providers.JsonRpcProvider(`https://rpc.tenderly.co/fork/${resp.data.simulation_fork.id}`))
          .catch(err=>{throw new Error(err)})
    }
  }
