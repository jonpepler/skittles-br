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
    @game.update(test_counter: (@game.test_counter || 0) + 1)
    GamesChannel.broadcast_to(@game, {
      action: 'counter_update',
      test_counter: @game.test_counter
    })
  end
end
