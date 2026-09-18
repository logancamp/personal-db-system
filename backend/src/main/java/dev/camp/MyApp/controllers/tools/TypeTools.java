package dev.camp.MyApp.controllers.tools;

import dev.camp.MyApp.models.CreationSource;
import dev.camp.MyApp.models.types.Type;
import dev.camp.MyApp.services.TypesService;
import org.springframework.ai.tool.annotation.Tool;
import org.springframework.ai.tool.annotation.ToolParam;
import org.springframework.stereotype.Component;

import java.util.List;

@Component
public class TypeTools {
    private final TypesService typesService;
    private final CurrentUser currentUser;

    public TypeTools(TypesService typesService, CurrentUser currentUser) {
        this.typesService = typesService;
        this.currentUser = currentUser;
    }

    @Tool(name = "list_types", description = "List the caller's custom item types, optionally filtered by name")
    public List<Type> listTypes(
            @ToolParam(description = "Text the type name must contain, or \"all\" for every type", required = true) String nameContains) {
        List<Type> types = typesService.findAllForUser(currentUser.username());
        if (nameContains == null || nameContains.isBlank() || "all".equalsIgnoreCase(nameContains)) {
            return types;
        }
        return types.stream()
                .filter(t -> t.name != null && t.name.toLowerCase().contains(nameContains.toLowerCase()))
                .toList();
    }

    @Tool(name = "add_type", description = "Create a new custom item type")
    public Type addType(@ToolParam(description = "Type name, e.g. 'recipe' or 'book'", required = true) String name) {
        Type type = new Type();
        type.name = name;
        return typesService.create(type, currentUser.id(), CreationSource.MCP, null);
    }

    @Tool(name = "rename_type", description = "Rename an existing type by id")
    public Type renameType(
            @ToolParam(description = "Type id", required = true) Long id,
            @ToolParam(description = "New name", required = true) String name) {
        Type updates = new Type();
        updates.name = name;
        return typesService.update(id, updates, currentUser.id());
    }

    @Tool(name = "delete_type", description = "Delete a type by id (fails if items still use it)")
    public void deleteType(@ToolParam(description = "Type id", required = true) Long id) {
        typesService.delete(id, currentUser.id());
    }
}