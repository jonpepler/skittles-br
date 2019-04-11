class GamesChannel < ApplicationCable::Channel
  def subscribed
    reject unless Game.find(params[:id]).players.include?(current_or_guest_player)
    stream_from "games_channel"
  end

  def unsubscribed
    # Any cleanup needed when channel is unsubscribed
  end
end
