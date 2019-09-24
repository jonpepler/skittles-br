import React from 'react'

import MatchMaker from './MatchMaker'

class LandingPage extends React.Component {
  constructor () {
    super()

    this.getFlag = this.getFlag.bind(this)

    this.state = {}

    this.getFlag()
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
        console.log(url)
        this.setState({ flagPath: url })
      })
    })
  }

  render () {
    return (
      <div>
        <h1>Skittles: BATTLE ROYALE</h1>
        <MatchMaker
          match={this.props.match}
          history={this.props.history}
          location={this.props.location}
        />
        <div className="flag">
          <img src={this.state.flagPath} alt="flag" className="flag__image" />
        </div>
      </div>
    )
  }
}
export default LandingPage
