import React from 'react'

import MatchMaker from './MatchMaker'

class LandingPage extends React.Component {
  render () {
    return (
      <div>
        <h1>Skittles: BATTLE ROYALE</h1>
        <MatchMaker
          match={this.props.match}
          history={this.props.history}
          location={this.props.location}
        />
      </div>
    )
  }
}
export default LandingPage
