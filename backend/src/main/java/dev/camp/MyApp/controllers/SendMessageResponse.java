package dev.camp.MyApp.controllers;

import dev.camp.MyApp.models.types.Message;

public record SendMessageResponse(Message sent, Message reply) {
}