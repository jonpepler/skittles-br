import React from 'react'
import ActionCable from 'actioncable'

class Game extends React.Component {
  constructor () {
    super()

    this.establishActionCable = this.establishActionCable.bind(this)
    this.handleReceiveNewData = this.handleReceiveNewData.bind(this)

    this.state = {
      gameData: {}
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
    this.setState({ gameData })
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
    return (<div>Wow! You're in a game: {this.props.id}</div>)
  }
}
export default Game
