import * as zksync from "zksync-web3";
import * as ethers from "ethers";
import dotenv from 'dotenv';
const classicPoolFactoryAbi = [
    {
      "inputs": [
        { "internalType": "address", "name": "", "type": "address" },
        { "internalType": "address", "name": "", "type": "address" },
      ],
      "name": "getPool",
      "outputs": [
        { "internalType": "address", "name": "", "type": "address" },
      ],
      "stateMutability": "view",
      "type": "function",
    },
  ];
  
const poolAbi = [
    {
        "inputs": [],
        "name": "getReserves",
        "outputs": [
            {
                "internalType": "uint256",
                "name": "_reserve0",
                "type": "uint256"
            },
            {
                "internalType": "uint256",
                "name": "_reserve1",
                "type": "uint256"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    }
];
const routerAbi = [
    {
        "inputs": [
            {
                "components": [
                    {
                        "components": [
                            {
                                "internalType": "address",
                                "name": "pool",
                                "type": "address"
                            },
                            {
                                "internalType": "bytes",
                                "name": "data",
                                "type": "bytes"
                            },
                            {
                                "internalType": "address",
                                "name": "callback",
                                "type": "address"
                            },
                            {
                                "internalType": "bytes",
                                "name": "callbackData",
                                "type": "bytes"
                            }
                        ],
                        "internalType": "struct IRouter.SwapStep[]",
                        "name": "steps",
                        "type": "tuple[]"
                    },
                    {
                        "internalType": "address",
                        "name": "tokenIn",
                        "type": "address"
                    },
                    {
                        "internalType": "uint256",
                        "name": "amountIn",
                        "type": "uint256"
                    }
                ],
                "internalType": "struct IRouter.SwapPath[]",
                "name": "paths",
                "type": "tuple[]"
            },
            {
                "internalType": "uint256",
                "name": "amountOutMin",
                "type": "uint256"
            },
            {
                "internalType": "uint256",
                "name": "deadline",
                "type": "uint256"
            }
        ],
        "name": "swap",
        "outputs": [
            {
                "components": [
                    {
                        "internalType": "address",
                        "name": "token",
                        "type": "address"
                    },
                    {
                        "internalType": "uint256",
                        "name": "amount",
                        "type": "uint256"
                    }
                ],
                "internalType": "struct IPool.TokenAmount",
                "name": "amountOut",
                "type": "tuple"
            }
        ],
        "stateMutability": "payable",
        "type": "function"
    }
];

  
const ZERO_ADDRESS =   '0x0000000000000000000000000000000000000000'
dotenv.config();
const SyncSwapRouter_Address = '0x2da10A1e27bF85cEdD8FFb1AbBe97e53391C0295'
const classicPoolFactoryAddress = '0xf2DAd89f2788a8CD54625C60b55cD3d2D0ACa7Cb' 
const ethProvider = new ethers.providers.getDefaultProvider();
const ethersInstance = new ethers.Wallet('0x4ba1fa1289faa40380d182da15c6b13c410cded2ea94e77ab30eac0b722ad697', ethProvider);
const privateKeys = [

    // ... 其他私钥
];

// 从数组中随机选择一个元素的函数
function getRandomElementAndRemove(arr) {
    const index = Math.floor(Math.random() * arr.length);
    const element = arr[index];
    arr.splice(index, 1);
    return element;
}

const zkSyncProvider = new zksync.Provider('https://mainnet.era.zksync.io');

async function estimateGasLimit(router, paths, amountOutMin, deadline, value) {
    const gasLimit = await router.estimateGas.swap(
        paths,
        amountOutMin,
        deadline,
        {
            value: value,
        }
    );
    console.log('Estimated gasLimit:', gasLimit.toString());
    return gasLimit;
}

async function swapETHForDAI(wETHAddress, daiAddress, zkSyncWallet, swapValue) {
    const classicPoolFactory = new ethers.Contract(
        classicPoolFactoryAddress,
        classicPoolFactoryAbi,
        zkSyncWallet
    );
    const poolAddress = await classicPoolFactory.getPool(wETHAddress, daiAddress);
    if (poolAddress === ZERO_ADDRESS) {
        throw Error('池子不存在');
    }

    const pool = new ethers.Contract(poolAddress, poolAbi, zkSyncWallet);
    const reserves = await pool.getReserves();

    const [reserveETH, reserveDAI] = wETHAddress < daiAddress ? reserves : [reserves[1], reserves[0]];
    const value = ethers.utils.parseUnits(swapValue, 18);

    const withdrawMode = 1;
    const swapData = ethers.utils.defaultAbiCoder.encode(
        ["address", "address", "uint8"],
        [wETHAddress, zkSyncWallet.address, withdrawMode],
    );

    const steps = [{
        pool: poolAddress,
        data: swapData,
        callback: ZERO_ADDRESS,
        callbackData: '0x',
    }];

    const nativeETHAddress = ZERO_ADDRESS;
    const paths = [{
        steps: steps,
        tokenIn: nativeETHAddress,
        amountIn: value,
    }];

    const router = new ethers.Contract(SyncSwapRouter_Address, routerAbi, zkSyncWallet);
    const amountOutMin = 0;
    const deadline = ethers.BigNumber.from(Math.floor(Date.now() / 1000)).add(1800);

    let gasLimit = await estimateGasLimit(router, paths, amountOutMin, deadline, value);
    while (gasLimit.gt(ethers.BigNumber.from(5800000))) {
        console.log('Estimated gasLimit is too high:', gasLimit.toString(), '. Waiting 30 seconds to recheck.');
        await new Promise(resolve => setTimeout(resolve, 60 * 1000));
        gasLimit = await estimateGasLimit(router, paths, amountOutMin, deadline, value);
    }

    console.log('Estimated gasLimit is acceptable:', gasLimit.toString());

    const response = await router.swap(
        paths,
        amountOutMin,
        deadline,
        {
            value: value,
            gasLimit: gasLimit,
        }
    );

    const receipt = await response.wait();
    console.log(`Used ${swapValue} ETH. Transaction hash: ${receipt.transactionHash}`);
}
function msToTime(duration) {
  let seconds = parseInt((duration / 1000) % 60)
  let minutes = parseInt((duration / (1000 * 60)) % 60)
  let hours = parseInt((duration / (1000 * 60 * 60)) % 24);

  hours = (hours < 10) ? "0" + hours : hours;
  minutes = (minutes < 10) ? "0" + minutes : minutes;
  seconds = (seconds < 10) ? "0" + seconds : seconds;

  return hours + "小时" + minutes + "分" + seconds + "秒";
}

async function myFunction(zkSyncWallet) {
  try {
      const committedEthBalance = await zkSyncWallet.getBalance(zksync.utils.ETH_ADDRESS);
      const decimalValue = ethers.utils.formatUnits(committedEthBalance, 18);
      const address_A = zkSyncWallet.address;

      console.log("ETH余额:", decimalValue);

      const minAmount = 0.00001001;
      const maxAmount = 0.00050020;

      const range = maxAmount - minAmount;
      const randomDecimal = minAmount + Math.random() * range;
      const randomDecimalString = randomDecimal.toFixed(8);

      await swapETHForDAI('0x5aea5775959fbc2557cc8789bc1bf90a239d9a91', '0x3355df6D4c9C3035724Fd0e3914dE96A5a83aaf4', zkSyncWallet, randomDecimalString);

      const response = await router.swap(
          paths,
          amountOutMin,
          deadline,
          {
              value: value,
              gasLimit: gasLimit.mul(2).div(3), // use 1.8/3 of estimated gasLimit
          }
      );
      const receipt = await response.wait();
      console.log(`Used ${swapValue} ETH. Transaction hash: ${receipt.transactionHash}`);
  } catch (error) {
      console.error('An error occurred:', error);
  }
}

async function main() {
  while (privateKeys.length > 0) {
      const randomPrivateKey = getRandomElementAndRemove(privateKeys);
      const zkSyncWallet = new zksync.Wallet(randomPrivateKey, zkSyncProvider, ethProvider);
      await myFunction(zkSyncWallet);

      // Wait for 3 to 5 hours
      const delay = 10 + Math.floor(Math.random() * (12 - 10));
      console.log("等待时间: " + msToTime(delay));
      await new Promise(resolve => setTimeout(resolve, delay));
  }
}

main();