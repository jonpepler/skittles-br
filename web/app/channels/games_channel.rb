class GamesChannel < ApplicationCable::Channel
  def subscribed
    @game = Game.find(params[:id])
    reject unless @game.players.include?(current_or_guest_player)
    stream_for @game
  end

  def unsubscribed
    @game.players.delete(current_or_guest_player)
  end

  def update_counter
    counter = $redis.get("game:#{@game.id}").to_i
    counter += 1
    $redis.set("game:#{@game.id}", counter)

    GamesChannel.broadcast_to(@game, {
      action: 'counter_update',
      test_counter: counter
    })
  end
end
