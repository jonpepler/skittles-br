import React from 'react'

import Game from './Game'

class MatchMaker extends React.Component {
  constructor () {
    super()

    this.newGame = this.newGame.bind(this)
    this.gameReady = this.gameReady.bind(this)
    this.leaveGame = this.leaveGame.bind(this)

    this.state = {
      gameFound: false
    }
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

  leaveGame () {
    this.setState({ gameFound: false, data: undefined })
  }

  render () {
    if (this.gameReady()) {
      return (
        <div>
          <Game
            id={this.state.data.id}
            pid={this.state.data.pid}
            leaveGame={this.leaveGame}
          />
        </div>
      )
    } else {
      return (<div className='btn btn--large' onClick={this.newGame}>New Game</div>)
    }
  }
}
export default MatchMaker
