import React from 'react';

import Game from './Game';

class LandingPage extends React.Component {
  constructor(){
    super();

    this.test = this.test.bind(this);

    this.state = {
      count: 0
    };
  }

  test() {
    this.setState(s => { return {count: s.count + 1}; });
  }

  render() {
    return(
      <div>
        <h1>Skittles: BATTLE ROYALE</h1>
        <Game/>
      </div>
    )
  }
}
export default LandingPage
