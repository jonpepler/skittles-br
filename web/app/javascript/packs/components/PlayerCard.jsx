import React from 'react';

import '../../src/player/card'

export default function PlayerCard(props) {
  const makeSkittle = colour => (
    <div className={`skittle skittle--${colour}`}>{props.skittles[colour]}</div>
  )
  return (
    <div className="player-card">
      <div className="player-card__flag-container">
        <img src={props.flag} alt="flag" className="flag__image" />
      </div>
      <div className="player-card__info">
        <div className="player-card__name">
          {props.name}
        </div>
        <div className="player-card__skittles">
          {makeSkittle('purple')}
          {makeSkittle('yellow')}
          {makeSkittle('green')}
          {makeSkittle('orange')}
          {makeSkittle('red')}
        </div>
      </div>
    </div>
  );
}