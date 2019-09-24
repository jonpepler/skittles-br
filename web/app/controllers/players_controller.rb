class PlayersController < ApplicationController
  def flag_path
    render json: url_for(current_or_guest_player.flag)
  end
end
