FROM ruby:2-alpine

RUN echo "http://dl-cdn.alpinelinux.org/alpine/edge/testing" >> /etc/apk/repositories \
  && apk update \
  && apk add --update-cache postgresql-client nodejs yarn \
    libffi-dev readline build-base postgresql-dev \
    libc-dev linux-headers libxml2-dev libxslt-dev readline-dev gcc libc-dev \
  && rm -rf /var/cache/apk/*

RUN mkdir /skittles-br
WORKDIR /skittles-br
COPY Gemfile /skittles-br/Gemfile
COPY Gemfile.lock /skittles-br/Gemfile.lock
RUN bundle install
COPY . /skittles-br

# Add a script to be executed every time the container starts.
COPY entrypoint.sh /usr/bin/
RUN chmod +x /usr/bin/entrypoint.sh
ENTRYPOINT ["entrypoint.sh"]
EXPOSE 3000

# Start the main process.
CMD ["rails", "server", "-b", "0.0.0.0"]
