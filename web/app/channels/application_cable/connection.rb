module ApplicationCable
  class Connection < ActionCable::Connection::Base
    identified_by :current_or_guest_player

    def connect
      self.current_or_guest_player = find_verified_player
    end

    private
      def find_verified_player
        id = cookies.encrypted[:player_id] || cookies.encrypted[:guest_player_id]
        byebug
        if verified_player = Player.find_by(id: id)
          verified_player
        else
          reject_unauthorized_connection
        end
      end
  end
end
