ROUTE_AND_SIMULATE = 'https://vc02kvm3ei.execute-api.us-east-1.amazonaws.com/prod/quote?tokenInAddress=0x6B175474E89094C44Da98b954EedeAC495271d0F&tokenInChainId=1&tokenOutAddress=0x1f9840a85d5af5bf1d1762f925bdaddc4201f984&tokenOutChainId=1&amount=1&type=exactIn&recipient=0x63946551716781c32f0269f87dc08521818b6292&slippageTolerance=5&deadline=360&simulate=true'

ROUTE = 'https://vc02kvm3ei.execute-api.us-east-1.amazonaws.com/prod/quote?tokenInAddress=0x6B175474E89094C44Da98b954EedeAC495271d0F&tokenInChainId=1&tokenOutAddress=0x1f9840a85d5af5bf1d1762f925bdaddc4201f984&tokenOutChainId=1&amount=1&type=exactIn&recipient=0x63946551716781c32f0269f87dc08521818b6292&slippageTolerance=5&deadline=360&simulate=false'

import requests
import time

TOTAL_TIME_TO_ROUTE = 0
for i in range(100):
  
  r = requests.get(ROUTE_AND_SIMULATE)
  print(r.json())
