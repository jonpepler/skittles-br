class HomeController < ApplicationController
  def main
    g = current_or_guest_player
    cookies.signed[:player_id] = g.id
  end
end
