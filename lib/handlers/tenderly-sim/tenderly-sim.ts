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
      hexData;
      const {
        fork,
        contract, //V3 router contract instance
      } = await this.getFork({chainId, blockNumber})

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
      
      const checkAllowance = (tokenAddress:string):{}=>{
        return {
          data: '0x571ac8b00000000000000000000000001f9840a85d5af5bf1d1762f925bdaddc4201f984',
          to: contract.address,
          value: BigNumber.from(0),
          from: fromAddress,
          gasPrice: ethers.utils.hexValue(1),
          gasLimit: ethers.utils.hexValue(30000000),
          type: 1,
        }
      }
      */

      const approve = {
        data: '0x095ea7b300000000000000000000000068b3465833fb72a70ecdf485e0e4c7bd8665fc45ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff',
        to: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        value: BigNumber.from(0),
        from: fromAddress,
        gasPrice: ethers.utils.hexValue(1),
        gasLimit: ethers.utils.hexValue(30000000),
        type: 1,
      }


      const swap = {
        data: hexData,
        to: contract.address,
        value: BigNumber.from(0),
        from: fromAddress,
        gasPrice: ethers.utils.hexValue(1),
        gasLimit: ethers.utils.hexValue(30000000),
        type: 1,
      }


      log.info({swapPayload:swap},"Swap")
  
      const approveMaxResponse: providers.TransactionResponse = await fork.getSigner(fromAddress).sendTransaction(approve)
      const approveMaxReceipt = await approveMaxResponse.wait();
      log.info({approveMaxReceipt:approveMaxReceipt}, "approvaMax");

      const swapResponse: providers.TransactionResponse = await fork.getSigner(fromAddress).sendTransaction(swap)
      const swapReceipt = await swapResponse.wait()
      
      return swapReceipt
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
        "simulation_type": "quick",
        "save_if_fails": true,
        "state_objects": {
          "balanceOf": {
            "0x63946551716781C32f0269F87DC08521818b6292": 9999999999
          }
        }
      }
      return axios
          .post(POST_TENDERLY_FORK_API_URL(this.TENDERLY_BASE_URL, this.TENDERLY_USER, this.TENDERLY_PROJECT), body, opts)
          .then(resp=>new ethers.providers.JsonRpcProvider(`https://rpc.tenderly.co/fork/${resp.data.simulation_fork.id}`))
          .catch(err=>{throw new Error(err)})
    }
  }
