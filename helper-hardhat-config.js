const { ethers } = require("hardhat")

const networkConfig = {
    default: {
        name: "hardhat",
        interval: "3",
    },
    5: {
        name: "goerli",
        vrfCoordinatorV2: "0x2Ca8E0C643bDe4C2E08ab1fA0da3401AdAD7734D",
        entranceFee: ethers.utils.parseEther("0.01"),
        gasLane: "0x79d3d8832d904592c0bf9818b621522c988bb8b0c05cdc3b15aea1b6e8db0c15",
        subscriptionId: "10364",
        callbackGasLimit: "5000000",
        interval: "3",
    },
    31337: {
        name: "localhost",
        entranceFee: ethers.utils.parseEther("0.01"),
        gasLane: "0x79d3d8832d904592c0bf9818b621522c988bb8b0c05cdc3b15aea1b6e8db0c15",
        interval: "3",
        subscriptionId: "0",
        callbackGasLimit: "5000000",
    },
}

const developmentChains = ["hardhat", "localhost"]
const VERIFICATION_BLOCK_CONFIRMATIONS = 6
// const frontEndContractsFile = "../nextjs-smartcontract-lottery-fcc/constants/contractAddresses.json"
// const frontEndAbiFile = "../nextjs-smartcontract-lottery-fcc/constants/abi.json"

module.exports = {
    networkConfig,
    developmentChains,
    VERIFICATION_BLOCK_CONFIRMATIONS,
    // frontEndContractsFile,
    // frontEndAbiFile,
}
