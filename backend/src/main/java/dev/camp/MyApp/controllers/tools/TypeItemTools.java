package dev.camp.MyApp.controllers.tools;

import dev.camp.MyApp.models.CreationSource;
import dev.camp.MyApp.models.types.TypeItem;
import dev.camp.MyApp.services.TypeItemsService;
import org.springframework.ai.tool.annotation.Tool;
import org.springframework.ai.tool.annotation.ToolParam;
import org.springframework.stereotype.Component;

import java.util.List;
import java.util.Map;

@Component
public class TypeItemTools {
    private final TypeItemsService typeItemsService;
    private final CurrentUser currentUser;

    public TypeItemTools(TypeItemsService typeItemsService, CurrentUser currentUser) {
        this.typeItemsService = typeItemsService;
        this.currentUser = currentUser;
    }

    @Tool(name = "list_items", description = "List the caller's custom items, optionally filtered by type id")
    public List<TypeItem> listItems(
            @ToolParam(description = "Type id to filter by, or omit for all types", required = false) Long typeId) {
        return typeItemsService.findAllForUser(currentUser.username(), typeId);
    }

    @Tool(name = "add_item", description = "Create a new custom item of a given type")
    public TypeItem addItem(
            @ToolParam(description = "Display name for this item", required = true) String customName,
            @ToolParam(description = "Arbitrary key/value fields for this item", required = false) Map<String, Object> fields) {
        TypeItem item = new TypeItem();
        item.customName = customName;
        item.fields = fields;
        return typeItemsService.create(item, currentUser.id(), CreationSource.MCP, null);
    }

    @Tool(name = "update_item", description = "Update an existing item's name and/or merge new fields into it")
    public TypeItem updateItem(
            @ToolParam(description = "Item id", required = true) Long id,
            @ToolParam(description = "New display name", required = false) String customName,
            @ToolParam(description = "Fields to merge in", required = false) Map<String, Object> fields) {
        TypeItem updates = new TypeItem();
        updates.customName = customName;
        updates.fields = fields;
        return typeItemsService.update(id, updates, currentUser.id());
    }

    @Tool(name = "delete_item", description = "Delete a custom item by id")
    public void deleteItem(@ToolParam(description = "Item id", required = true) Long id) {
        typeItemsService.delete(id, currentUser.id());
    }
}