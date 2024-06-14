import axios, { AxiosRequestConfig, AxiosResponse } from 'axios'

import { GraphQLResponse } from './graphql-schemas'

/* Interface for accessing any GraphQL API */
export interface IGraphQLClient {
  fetchData<T>(query: string, variables?: { [key: string]: any }): Promise<T>
}

/* Implementation of the IGraphQLClient interface to give access to any GraphQL API */
export class GraphQLClient implements IGraphQLClient {
  constructor(private readonly endpoint: string, private readonly headers: Record<string, string>) {}

  async fetchData<T>(query: string, variables: { [key: string]: any } = {}): Promise<T> {
    const requestConfig: AxiosRequestConfig = {
      method: 'POST',
      url: this.endpoint,
      headers: this.headers,
      data: { query, variables },
    }

    try {
      const response: AxiosResponse<GraphQLResponse<T>> = await axios.request(requestConfig)
      const responseBody = response.data
      if (responseBody.errors) {
        throw new Error(`GraphQL error! ${JSON.stringify(responseBody.errors)}`)
      }

      return responseBody.data
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`HTTP error! status: ${error.response?.status}`)
      } else {
        throw new Error(`Unexpected error: ${error}`)
      }
    }
  }
}
