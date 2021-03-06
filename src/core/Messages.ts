/***************************************************************************************************************************
 * @license                                                                                                                *
 * Copyright 2017 Coinbase, Inc.                                                                                           *
 *                                                                                                                         *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance          *
 * with the License. You may obtain a copy of the License at                                                               *
 *                                                                                                                         *
 * http://www.apache.org/licenses/LICENSE-2.0                                                                              *
 *                                                                                                                         *
 * Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on     *
 * an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied. See the                      *
 * License for the specific language governing permissions and limitations under the License.                              *
 ***************************************************************************************************************************/

import { OrderbookState } from '../lib/Orderbook';
import { Side } from '../lib/sides';
import { Ticker } from '../exchanges/PublicExchangeAPI';
/**
 * Interfaces for the GTT Stream message types. These messages are generated and passed on my the GTT streaming
 * infrastructure. The `type` field is conventionally named after the interface, first letter lowercased,  with the word Message
 * stripped out, so e.g. HeartbeatMessage => heartbeat and NewOrderMessage => newOrder
 *
 * The origin field, if present represents the original unmodified message that was mapped (e.g. original trade message from exchange)
 */

export interface StreamMessage {
    type: string;
    time: Date;
    origin?: any;
}

export function isStreamMessage(msg: any): msg is StreamMessage {
    return !!msg.type;
}

export interface ErrorMessage extends StreamMessage {
    type: 'error';
    message: string;
    cause: any;
}

export interface HTTPErrorMessage extends ErrorMessage {
    cause: {
        status: number;
        body: any;
    };
}

export function isErrorMessage(msg: any): msg is ErrorMessage {
    return msg.type === 'error';
}

/**
 * Interface for any message type not supported explicitly elsewhere.
 * The type must always be 'unknown'. If the source of the message is actually known, (e.g. trollbox chats), this can be indicated in the `tag` field.
 * Any context-rich information can be extracted into the `extra` field, and the original message should be attached to the `origin` field as usual.
 */
export interface UnknownMessage extends StreamMessage {
    type: 'unknown';
    sequence?: number;
    productId?: string;
    tag?: string;
    extra?: any;
}

export function isUnknownMessage(msg: any): msg is UnknownMessage {
    return msg.type === 'unknown';
}

export interface SequencedMessage {
    sequence: number;
    sourceSequence?: number;
}

export function isSequencedMessage(msg: any): msg is SequencedMessage {
    return typeof msg.sequence === 'number';
}

/**
 * Root definition for messages that stem from a websocket feed
 */
export interface OrderbookMessage extends SequencedMessage, StreamMessage {
    type: 'newOrder' | 'orderDone' | 'changedOrder' | 'level';
    productId: string;
    side: Side;
}

export function isOrderbookMessage(msg: any): msg is OrderbookMessage {
    return isStreamMessage(msg) && isSequencedMessage(msg) && !!(msg as OrderbookMessage).productId && !!(msg as OrderbookMessage).side;
}

// ---------------------------------------- Order-level (Level 3) Messages --------------------------------------------//

/**
 * Message representing the common state for a resting order (for an order request, see PlaceOrderRequest)
 */
export interface BaseOrderMessage extends OrderbookMessage {
    type: 'newOrder' | 'orderDone' | 'changedOrder';
    orderId: string;
    price: string;
}

export function isBaseOrderMessage(msg: any): msg is BaseOrderMessage {
    return msg.orderId && msg.price && isOrderbookMessage(msg);
}

/**
 * In order-level books, represents a new order.
 *
 * `orderType` is market, limit, stop
 */
export interface NewOrderMessage extends BaseOrderMessage {
    type: 'newOrder';
    size: string;
}

/**
 * In order-level books, means an order has been filled, or cancelled. RemainingSize indicated how much of the order
 * was left unfilled if it was cancelled
 */
export interface OrderDoneMessage extends BaseOrderMessage {
    type: 'orderDone';
    reason: string;
    remainingSize: string;
}

/**
 * In order-level books, means the size of an existing order has changed. Either `newSize` (which replaces the old value)
 * or changedAmount (which adds to the old value) must be specified.
 */
export interface ChangedOrderMessage extends BaseOrderMessage {
    type: 'changedOrder';
    newSize?: string;
    changedAmount?: string;
}

// ------------------------------------- Aggregate book (Level 2) Messages --------------------------------------------//

/**
 * Represents a price-level change in an orderbook. The `size` parameter represents the new size of the level and should
 * replace the old one.
 */
export interface LevelMessage extends OrderbookMessage {
    type: 'level';
    price: string;
    size: string;
    count: number;
}

/**
 * Reflects a trade that has taken place. This message does not impact the orderbook, and as such does not carry a
 * sequence field. A corresponding `level`, `done`, or 'change` message will also be sent.
 */
export interface TradeMessage extends StreamMessage {
    type: 'trade';
    productId: string;
    side: Side;
    tradeId: string;
    price: string;
    size: string;
}

export interface SnapshotMessage extends StreamMessage, OrderbookState {
    type: 'snapshot';
    productId: string;
}

export function isSnapshotMessage(msg: any): msg is SnapshotMessage {
    return msg.type === 'snapshot';
}

export interface TickerMessage extends StreamMessage, Ticker {
    type: 'ticker';
    productId: string;
}

// ------------------------------------------- User Trade Messages  -----------------------------------------------//

/**
 * A new order request message. Only the most common fields are specified here. Additional options can be specified
 * in the extra field, which can be handled by the target trade engine.
 */
export interface PlaceOrderMessage extends StreamMessage {
    type: 'placeOrder';
    productId: string;
    clientId?: string;
    side: Side;
    orderType: string;
    price?: string;
    postOnly?: boolean;
    size?: string;
    funds?: string;
    extra?: any;
}

export interface CancelOrderRequestMessage extends StreamMessage {
    type: 'cancelOrder';
    orderId: string;
}

/**
 * Emitted from a feed when one of my orders has been matched. (An authenticated feed is required)
 */
export interface TradeExecutedMessage extends StreamMessage {
    type: 'tradeExecuted';
    productId: string;
    orderId: string;
    side: Side;
    price: string;
    orderType: string;
    tradeSize: string;
    remainingSize: string;
}

export interface TradeFinalizedMessage extends StreamMessage {
    type: 'tradeFinalized';
    productId: string;
    orderId: string;
    side: Side;
    price: string;
    remainingSize: string;
    reason: string;
}

export interface MyOrderPlacedMessage extends StreamMessage {
    type: 'myOrderPlaced';
    productId: string;
    orderId: string;
    side: Side;
    price: string;
    orderType: string;
    size: string;
    sequence: number;
}

/**
 * Sanitises a message by replacing any keys in the msg object with '***'.
 * Keys are searched recursively.
 * The original message is not modified.
 */
export function sanitizeMessage(msg: { [index: string]: any }, sensitiveKeys: string[]): any {
    const clean: any = {};
    for (const key in msg) {
        if (msg.hasOwnProperty(key)) {
            if (sensitiveKeys.includes(key)) {
                clean[key] = '***';
            } else if (typeof msg[key] === 'object') {
                clean[key] = sanitizeMessage(msg[key], sensitiveKeys);
            } else {
                clean[key] = msg[key];
            }
        }
    }
    return clean;
}
