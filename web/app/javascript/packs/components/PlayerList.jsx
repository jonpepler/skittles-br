import React from 'react'

import PlayerCard from './PlayerCard.jsx'

import '../../src/player/list'

export default function PlayerList(props) {
  const players = props.players.map(player => {
    return (<PlayerCard
      key={player.pid}
      name={player.name}
      flag={player.flag}
      skittles={player.skittles}
    />)
  })
  return (
    <div className="player-list">
      {players}
    </div>
  )
}
