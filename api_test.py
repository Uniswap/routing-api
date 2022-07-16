mainnet_dai = '0x6b175474e89094c44da98b954eedeac495271d0f'
mainnet_usdc = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48'
mainnet_uni = '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984'

goerli_dai = '0x11fe4b6ae13d2a6055c8d9cf65c55bac32b5d844'
goerli_usdc = '0x07865c6e87b9f70255377e024ace6630c1eaa37f'
chainId = 1
amount = 10
type = 'exactIn'
recipient = '0x63946551716781c32f0269f87dc08521818b6292'
N = 200

ROUTE_AND_SIMULATE = 'https://vc02kvm3ei.execute-api.us-east-1.amazonaws.com/prod/quote?tokenInAddress={}&tokenInChainId={}&tokenOutAddress={}&tokenOutChainId={}&amount={}&type={}&recipient={}&slippageTolerance=5&deadline=360&simulate=true'.format(mainnet_usdc, chainId, mainnet_uni, chainId, amount, type, recipient)

ROUTE = 'https://vc02kvm3ei.execute-api.us-east-1.amazonaws.com/prod/quote?tokenInAddress={}&tokenInChainId={}&tokenOutAddress={}&tokenOutChainId={}&amount={}&type={}&recipient={}&slippageTolerance=5&deadline=360&simulate=false'.format(mainnet_usdc, chainId, mainnet_dai, chainId, amount, type, recipient)

import requests
import time

WITHOUT_SIMULATE = WITH_SIMULATE = SIMULATED_GAS_ESTIMATE = HEURISTIC_GAS_ESTIMATE = SIMULATION_FAILURES = 0
for i in range(0):
  start = time.time()
  r = requests.get(ROUTE)
  WITHOUT_SIMULATE += time.time()-start
  HEURISTIC_GAS_ESTIMATE += int(r.json()['gasUseEstimate'])
  if(i%10==1):
    print("ROUTING WITHOUT SIMULATING: Iteration {} Completed".format(i))
  time.sleep(10)

for i in range(1):
  start = time.time()
  r = requests.get(ROUTE_AND_SIMULATE)
  WITH_SIMULATE += time.time()-start
  try:
    SIMULATED_GAS_ESTIMATE += int(r.json()['simulatedTxReceipt'],base=16)
  except:
    SIMULATION_FAILURES += 1
  print(r.json())
  if(i%10==1):
    print("ROUTING WITH SIMULATING: Iteration {} Completed".format(i))
  time.sleep(3)

print("TOTAL TIME TO ROUTE WITHOUT SIMULATE: {}\nTOTAL TIME TO ROUTE WITH SIMULATE: {}".format(WITHOUT_SIMULATE, WITH_SIMULATE))
print("TOTAL HEURISTIC_GAS_ESTIMATE: {}\nTOTAL SIMULATED_GAS_ESTIMATE: {}".format(HEURISTIC_GAS_ESTIMATE, SIMULATED_GAS_ESTIMATE))
print("TOTAL SIMULATION_FAILURES: {}".format(SIMULATION_FAILURES))
