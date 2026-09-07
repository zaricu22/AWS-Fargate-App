package com.example.items.item;

import org.springframework.stereotype.Service;

import java.util.List;

@Service
public class ItemService {

    private final ItemRepository itemRepository;

    public ItemService(ItemRepository itemRepository) {
        this.itemRepository = itemRepository;
    }

    public List<ItemDto> findAll() {
        return itemRepository.findAll().stream()
                .map(ItemDto::from)
                .toList();
    }
}
