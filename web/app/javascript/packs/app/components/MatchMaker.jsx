import React from 'react'
import ActionCable from 'actioncable'

import Game from './Game'

class MatchMaker extends React.Component {
  constructor () {
    super()

    this.establishActionCable = this.establishActionCable.bind(this)
    this.handleReceiveNewData = this.handleReceiveNewData.bind(this)
    this.newGame = this.newGame.bind(this)
    this.gameReady = this.gameReady.bind(this)

    this.state = {
      gameFound: false
    }
  }

  componentDidMount () {
    this.establishActionCable()
  }

  establishActionCable () {
    const cable = ActionCable.createConsumer('/cable')
    this.sub = cable.subscriptions.create({ channel: 'GameChannel', id: this.state.gameID }, {
      received: this.handleReceiveNewData
    })
  }

  handleReceiveNewData (data) {
    this.setState({ data })
  }

  newGame () {
    fetch('/game/find_or_create')
      .then(response => {
        if (!response.ok) throw Error(response.statusText)
        return response
      })
      .then(response => { return response.json() })
      .then(data => { this.setState({ data, gameFound: true }) })
  }

  gameReady () {
    return this.state.gameFound && this.state.data.id
  }

  render () {
    if (this.gameReady()) {
      return (
        <div>
          <Game id={this.state.data.id} />
        </div>
      )
    } else {
      return (<div className='btn btn--large' onClick={this.newGame}>New Game</div>)
    }
  }
}
export default MatchMaker
