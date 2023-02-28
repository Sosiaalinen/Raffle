const { assert, expect } = require("chai")
const { getNamedAccounts, deployments, network, ethers } = require("hardhat")
const { developmentChains, networkConfig } = require("../../helper-hardhat-config")

!developmentChains.includes(network.name)
    ? describe.skip
    : describe("Raffle Unit tests", function () {
          let raffle, VRFCoordinatorV2Mock, entranceFee, deployer, interval
          const chainId = network.config.chainId

          beforeEach(async function () {
              deployer = (await getNamedAccounts()).deployer
              await deployments.fixture("all")
              VRFCoordinatorV2Mock = await ethers.getContract("VRFCoordinatorV2Mock", deployer)
              raffle = await ethers.getContract("Raffle", deployer)
              entranceFee = await raffle.getEntranceFee()
              interval = await raffle.getInterval()
          })

          describe("constructor", function () {
              console.log(networkConfig)
              console.log(chainId)
              it("initializes the raffle correctly", async function () {
                  const raffleState = await raffle.getRaffleState()
                  const interval = await raffle.getInterval()
                  assert.equal(raffleState.toString(), "0")
                  assert.equal(interval.toString(), networkConfig[chainId]["interval"])
              })
          })

          describe("enterRaffle", function () {
              it("reverts if you don't pay enough", async function () {
                  await expect(raffle.enterRaffle()).to.be.revertedWith("Raffle__NotEnoughETH")
              })
              it("keeps record of entering players", async function () {
                  await raffle.enterRaffle({ value: entranceFee })
                  const playerFromContract = await raffle.getPlayer(0)
                  assert.equal(playerFromContract, deployer)
              })
              it("emits event on enter", async () => {
                  await expect(raffle.enterRaffle({ value: entranceFee })).to.emit(
                      raffle,
                      "RaffleEnter"
                  )
              })
              it("doesn't allow entrance when raffle is calculating", async function () {
                  await raffle.enterRaffle({ value: entranceFee })
                  await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                  await network.provider.send("evm_mine", [])
                  // Pretend to be a Chainlink Keeper -- empty call data === []
                  await raffle.performUpkeep([])
                  await expect(raffle.enterRaffle({ value: entranceFee })).to.be.revertedWith(
                      "Raffle__NotOpen"
                  )
              })
              describe("checkUpkeep", function () {
                  it("returns false if people haven't send any eth", async function () {
                      await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                      await network.provider.send("evm_mine", [])
                      const { upkeepNeeded } = await raffle.callStatic.checkUpkeep([])
                      assert(!upkeepNeeded)
                  })
                  it("returns false if raffle isn't open", async function () {
                      await raffle.enterRaffle({ value: entranceFee })
                      await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                      await network.provider.send("evm_mine", [])
                      await raffle.performUpkeep("0x")
                      const raffleState = await raffle.getRaffleState()
                      const { upkeepNeeded } = await raffle.callStatic.checkUpkeep([])
                      assert.equal(raffleState.toString(), "1")
                      assert.equal(upkeepNeeded, false)
                  })
              })
              describe("performUpkeep", function () {
                  it("can only run if checkupkeep is true", async function () {
                      await raffle.enterRaffle({ value: entranceFee })
                      await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                      await network.provider.send("evm_mine", [])
                      const tx = await raffle.performUpkeep([])
                      assert(tx)
                  })
                  it("reverts when checkUpkeep is false", async function () {
                      await expect(raffle.performUpkeep([])).to.be.revertedWith(
                          "Raffle__UpkeepNotNeeded"
                      )
                  })
                  it("updates the raffle state, emits and event, and calls the vrf coordinator", async function () {
                      await raffle.enterRaffle({ value: entranceFee })
                      await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                      await network.provider.send("evm_mine", [])
                      const txResponse = await raffle.performUpkeep([])
                      const txReceipt = await txResponse.wait(1)
                      const requestId = txReceipt.events[1].args.requestId
                      const raffleState = await raffle.getRaffleState()
                      assert(requestId.toNumber() > 0)
                      assert(raffleState.toString() == "1")
                  })
              })
              describe("fulfillRandomWords", function () {
                  beforeEach(async function () {
                      await raffle.enterRaffle({ value: entranceFee })
                      await network.provider.send("evm_increaseTime", [interval.toNumber() + 1])
                      await network.provider.send("evm_mine", [])
                  })
                  it("can only be called after performUpkeep", async function () {
                      await expect(
                          VRFCoordinatorV2Mock.fulfillRandomWords(0, raffle.address)
                      ).to.be.revertedWith("nonexistent request")
                      await expect(
                          VRFCoordinatorV2Mock.fulfillRandomWords(1, raffle.address)
                      ).to.be.revertedWith("nonexistent request")
                  })
              })
              // Wayyy to big test
              it("picks a winner, resets the lottery and sends money", async function () {
                  const additionalEntrants = 3
                  const startingAccountIndex = 1 // deployer 0
                  const accounts = await ethers.getSigners()
                  for (
                      let index = startingAccountIndex;
                      index < startingAccountIndex + additionalEntrants;
                      index++
                  ) {
                      const accountConnectedRaffle = raffle.connect(accounts[index])
                      await accountConnectedRaffle.enterRaffle({ value: entranceFee })
                  }
                  const startingTimeStamp = await raffle.getLatestTimeStamp()
                  // perform upkeep mock being cahinlink keepers
                  // fullfillrandom words mocks vrf
                  await new Promise(async (resolve, reject) => {
                      raffle.once("WinnerPicked", async () => {
                          console.log("found the event!")

                          try {
                              const recentWinner = await raffle.getRecentWinner()
                              console.log(recentWinner)
                              console.log(accounts[0].address)
                              console.log(accounts[1].address)
                              console.log(accounts[2].address)
                              console.log(accounts[3].address)
                              const raffleState = await raffle.getRaffleState()
                              const endingTimeStamp = await raffle.getLatestTimeStamp()
                              const numPlayers = await raffle.getNumberOfPlayers()
                              const winnerEndingBalance = await accounts[3].getBalance()
                              assert.equal(numPlayers.toString(), "0")
                              assert.equal(raffleState.toString(), "0")
                              assert(endingTimeStamp > startingTimeStamp)

                              assert.equal(
                                  winnerEndingBalance.toString(),
                                  winnerStartingBalance.add(
                                      entranceFee
                                          .mul(additionalEntrants - 1)
                                          .add(entranceFee)
                                          .toString()
                                  )
                              )
                          } catch (e) {
                              reject(e)
                          }
                          resolve()
                      })

                      const tx = await raffle.performUpkeep([])
                      const txReceipt = await tx.wait(1)
                      const winnerStartingBalance = await accounts[3].getBalance()
                      await VRFCoordinatorV2Mock.fulfillRandomWords(
                          txReceipt.events[1].args.requestId,
                          raffle.address
                      )
                  })
              })
          })
      })
