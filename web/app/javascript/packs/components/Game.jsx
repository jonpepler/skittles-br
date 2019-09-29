import React from 'react'
import ActionCable from 'actioncable'

import PlayerList from './PlayerList'

class Game extends React.Component {
  constructor () {
    super()

    this.establishActionCable = this.establishActionCable.bind(this)
    this.handleReceiveNewData = this.handleReceiveNewData.bind(this)
    this.getFlag = this.getFlag.bind(this)
    this.updateSkittles = this.updateSkittles.bind(this)

    this.state = {
      gameData: {},
      players: [],
      skittles: {
        purple: 0,
        yellow: 0,
        green: 0,
        orange: 0,
        red: 0
      }
    }

    this.getFlag()
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

  getFlag () {
    fetch('/flag_path', {
      method: 'GET',
      headers: {
        'X-CSRF-Token': document.querySelector('meta[name=csrf-token]').content
      },
      credentials: 'same-origin'
    }).then(response => {
      response.text().then(url => {
        this.setState({ flagPath: url })
      })
    })
  }

  handleReceiveNewData (gameData) {
    console.log(gameData)
    switch (gameData.action) {
      case 'player_update': {
        this.setState({ players: gameData.players })

        // NOTE think about the security of this, and how you want it to work
        let thisPlayer = gameData.players.find(player => player.pid === this.props.pid)
        if (thisPlayer) this.setState({ skittles: thisPlayer.skittles })
        if (thisPlayer) this.setState({ flagPath: thisPlayer.flag })

        break
      }
      default: {
        console.log(gameData.id)
        this.setState({ gameID: gameData.id })
      }
    }
  }

  /*
    NOTE: In the future it should only be possible
    to take actions that affect skittles, not
    change their values directly
  */
  updateSkittles (colour, value) {
    this.setState(s => {
      let newValue = {}
      newValue[colour] = value
      return {
        skittles: {
          ...s.skittles,
          ...newValue
        }
      }
    }, () => this.sub.perform('update_skittles', { skittles: this.state.skittles }))
  }

  render () {
    return (
      <div>
        <div>
          Wow! You're in a game: {this.state.gameID}
        </div>
        <div>
          <div className='score-panel'>
            <div className='btn' onClick={() => this.updateSkittles('purple', this.state.skittles.purple + 1)}>
              (purple): {this.state.skittles.purple}
            </div>
            <div className='btn' onClick={() => this.updateSkittles('yellow', this.state.skittles.yellow + 1)}>
              (yellow): {this.state.skittles.yellow}
            </div>
            <div className='btn' onClick={() => this.updateSkittles('green', this.state.skittles.green + 1)}>
              (green): {this.state.skittles.green}
            </div>
            <div className='btn' onClick={() => this.updateSkittles('orange', this.state.skittles.orange + 1)}>
              (orange): {this.state.skittles.orange}
            </div>
            <div className='btn' onClick={() => this.updateSkittles('red', this.state.skittles.red + 1)}>
              (red): {this.state.skittles.red}
            </div>
          </div>
        </div>
        <PlayerList players={this.state.players}/>
      </div>
    )
  }
}
export default Game
