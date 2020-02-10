class GamesChannel < ApplicationCable::Channel
  def subscribed
    @game = Game.find(params[:id])
    reject unless @game.players.include?(current_or_guest_player)
    stream_for @game

    update_players
  end

  def unsubscribed
    @game.players.delete(current_or_guest_player)
    current_or_guest_player.leave_current_game

    update_players
  end

  def quit
    unsubscribed
  end

  def update_skittles(data)
    current_or_guest_player.update_skittles data['skittles']

    @game.reload
    @game.update_game_info
  end

  def update_players
    GamesChannel.broadcast_to(@game, {
      game_id: @game.id,
      action: 'player_update',
      players: @game.player_info
    })
  end

  def update_colour_values_NAME?
    values = $redis.hgetall("game:#{@game.id}:#{current_or_guest_player.id}")
  end
end
