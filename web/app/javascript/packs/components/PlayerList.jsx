import React from 'react'

class PlayerList extends React.Component {
  render () {
    let players = []
    this.props.players.forEach(player => {
      let skittles = []
      Object.keys(player.skittles).forEach(skittleKey => {
        skittles.push(
          <div key={skittleKey}>
            {skittleKey}: {player.skittles[skittleKey]}
          </div>
        )
      })

      players.push(
        <div key={player.pid}>
          <div>
            {player.name}
          </div>
          <div>
            {skittles}
          </div>
        </div>
      )
    })
    return (
      <div>
        {players}
      </div>
    )
  }
}
export default PlayerList
