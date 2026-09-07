package com.example.items.item;

import java.time.OffsetDateTime;

public record ItemDto(Long id, String name, String description, OffsetDateTime createdAt) {

    static ItemDto from(Item item) {
        return new ItemDto(item.getId(), item.getName(), item.getDescription(), item.getCreatedAt());
    }
}
