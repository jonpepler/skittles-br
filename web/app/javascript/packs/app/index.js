import React from 'react';
import ReactDOM from 'react-dom';
import Routes from './routes';
console.log('error!')
document.addEventListener('DOMContentLoaded', () => {
  ReactDOM.render(
    <Routes />, document.getElementById('app'),
  )
});
