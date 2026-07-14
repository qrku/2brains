'use client';

import {
  Client,
  cacheExchange,
  fetchExchange,
  subscriptionExchange,
  type SubscriptionForwarder,
} from 'urql';

/**
 * Подписки едут по SSE, а не по WebSocket: Next route handler не умеет
 * Upgrade-хендшейк, а graphql-yoga отдаёт subscriptions через SSE из коробки.
 * Когда появится настоящий бэкенд с WS — меняется только этот exchange.
 */
const sseSubscription: SubscriptionForwarder = (request) => {
  return {
    subscribe(sink) {
      const url = new URL('/api/graphql', window.location.origin);
      url.searchParams.set('query', request.query ?? '');
      if (request.variables) {
        url.searchParams.set('variables', JSON.stringify(request.variables));
      }

      const source = new EventSource(url.toString());

      // Yoga шлёт именованные события next/complete, поэтому onmessage не сработает.
      source.addEventListener('next', (event) => {
        sink.next(JSON.parse((event as MessageEvent).data));
      });
      source.addEventListener('complete', () => {
        source.close();
        sink.complete();
      });
      source.addEventListener('error', (event) => {
        // EventSource сам переподключается при обрыве; фатально только если он сдался.
        if (source.readyState === EventSource.CLOSED) sink.error(event);
      });

      return {
        unsubscribe() {
          source.close();
        },
      };
    },
  };
};

export const gqlClient = new Client({
  url: '/api/graphql',
  exchanges: [
    cacheExchange,
    fetchExchange,
    subscriptionExchange({ forwardSubscription: sseSubscription }),
  ],
});
