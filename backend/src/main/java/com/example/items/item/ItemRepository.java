package com.example.items.item;

import org.springframework.data.jpa.repository.JpaRepository;

// AWS: Configured in application.yml; sourced by Data-Stack and set by Backend-Stack in ECS+Fargate task definition.
public interface ItemRepository extends JpaRepository<Item, Long> {
}
