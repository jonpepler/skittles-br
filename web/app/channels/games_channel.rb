class GamesChannel < ApplicationCable::Channel
  def subscribed
    @game = Game.find(params[:id])
    reject unless @game.players.include?(current_or_guest_player)
    stream_for @game
  end

  def unsubscribed
    @game.players.delete(current_or_guest_player)
  end

  def update_skittles(data)
    id_string = "game:#{@game.id}:#{current_or_guest_player.id}"
    skittles = data['skittles']

    $redis.set(id_string, skittles.to_json)

    GamesChannel.broadcast_to(@game, {
      game_id: @game.id,
      action: 'skittles_update',
      skittles: JSON.parse($redis.get(id_string)),
      player: current_or_guest_player.id
    })
  end

  def update_colour_values_NAME?
    values = $redis.hgetall("game:#{@game.id}:#{current_or_guest_player.id}")
  end
end
