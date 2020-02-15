class GamesChannel < ApplicationCable::Channel
  def subscribed
    @game = Game.find(params[:id])
    reject unless @game.players.include?(current_or_guest_player)
    stream_for @game

    @game.update_game_info
  end

  def unsubscribed
    @game.remove_player current_or_guest_player
  end

  def quit
    unsubscribed
  end

  def update_skittles(data)
    current_or_guest_player.update_skittles data['skittles']

    @game.reload
    @game.update_game_info
  end
end
