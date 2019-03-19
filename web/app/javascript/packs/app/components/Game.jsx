import React from 'react'
import ActionCable from 'actioncable'

class Game extends React.Component {
  constructor () {
    super()

    this.establishActionCable = this.establishActionCable.bind(this)
    this.handleReceiveNewData = this.handleReceiveNewData.bind(this)
    this.newGame = this.newGame.bind(this)

    this.state = {
      inGame: false
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
      .then(data => { this.setState({ data, inGame: true }) })
  }

  render () {
    if (this.state.inGame) {
      let divs = []
      debugger
      Object.keys(this.state.data).forEach(k => divs.push(<div>{this.state.data[k].toString()}</div>))
      return (
        <React.Fragment>
          {divs}
        </React.Fragment>
      )
    } else {
      return (<div className='btn btn--large' onClick={this.newGame}>New Game</div>)
    }
  }
}
export default Game
