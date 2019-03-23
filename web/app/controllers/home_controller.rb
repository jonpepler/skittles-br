class HomeController < ApplicationController
  def main
    g = current_or_guest_player
    session['player_id'] = g
  end
end
