class HomeController < ApplicationController
  def main
    g = current_or_guest_player
    cookies.signed[:player_id] = g.id

    uri = URI("http://flag-generator:3002/random-flag")
    http = Net::HTTP.new(uri.host, uri.port)
    request = Net::HTTP::Get.new(uri.path)
    response = http.request(request)
    @flag_image = response.body
  end
end
