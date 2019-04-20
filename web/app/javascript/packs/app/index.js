import React from 'react'
import ReactDOM from 'react-dom'
import Routes from './routes'
import { API_WS_ROOT } from './constants'

import '../../src/app'

document.addEventListener('DOMContentLoaded', () => {
  ReactDOM.render(
    <Routes />, document.getElementById('app')
  )
})
