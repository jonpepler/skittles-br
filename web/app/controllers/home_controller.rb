class HomeController < ApplicationController
  def main
    g = current_or_guest_player
    cookies.signed[:player_id] = g.id

    current_or_guest_player.get_flag
  end
end
