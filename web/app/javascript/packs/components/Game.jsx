import React from 'react'
import ActionCable from 'actioncable'

class Game extends React.Component {
  constructor () {
    super()

    this.establishActionCable = this.establishActionCable.bind(this)
    this.handleReceiveNewData = this.handleReceiveNewData.bind(this)
    this.updateChannel = this.updateChannel.bind(this)

    this.state = {
      gameData: {},
      testCounter: 0
    }
  }

  componentDidMount () {
    this.establishActionCable()
  }

  establishActionCable () {
    const cable = ActionCable.createConsumer('/cable')
    this.sub = cable.subscriptions.create({ channel: 'GamesChannel', id: this.props.id }, {
      received: this.handleReceiveNewData
    })
  }

  handleReceiveNewData (gameData) {
    console.log(gameData)
    switch (gameData.action) {
      case 'counter_update': {
        console.log(gameData.test_counter)
        this.setState({ testCounter: gameData.test_counter })
        break
      }
      default: {
        console.log(gameData.id)
        this.setState({ gameID: gameData.id })
      }
    }
  }

  updateChannel () {
    this.sub.perform('update_counter')
  }

  render () {
    // if (this.state.inGame) {
    //   let divs = []
    //   debugger
    //   Object.keys(this.state.data).forEach(k => divs.push(<div>{this.state.data[k].toString()}</div>))
    //   return (
    //     <React.Fragment>
    //       {divs}
    //     </React.Fragment>
    //   )
    // } else {
    //   return (<div className='btn btn--large' onClick={this.newGame}>New Game</div>)
    // }
    return (
      <div>
        <div>
          Wow! You're in a game: {this.state.gameID}
        </div>
        <div>
          <div>Your score: {this.state.counter}</div>
          <div className='score-panel'>
            <div className='btn' onClick={this.updateChannel}>
              (increase)
            </div>
            <div className='score-panel--counter'>
              {this.state.testCounter}
            </div>
          </div>
        </div>
      </div>
    )
  }
}
export default Game
