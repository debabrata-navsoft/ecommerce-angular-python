from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin

from .models import Address, CartItem, Order, OrderItem, Product, SavedLaterItem, User, WishlistItem


@admin.register(User)
class UserAdmin(BaseUserAdmin):
    list_display = ('email', 'first_name', 'last_name', 'role', 'is_active', 'created_at')
    list_filter = ('role', 'is_active', 'is_staff')
    search_fields = ('email', 'first_name', 'last_name')
    ordering = ('-created_at',)

    fieldsets = (
        (None, {'fields': ('email', 'password')}),
        ('Profile', {'fields': ('first_name', 'last_name', 'phone_numbers')}),
        ('Permissions', {'fields': ('role', 'is_active', 'is_staff', 'is_superuser')}),
    )
    add_fieldsets = (
        (
            None,
            {
                'classes': ('wide',),
                'fields': ('email', 'first_name', 'last_name', 'role', 'password1', 'password2'),
            },
        ),
    )


@admin.register(Product)
class ProductAdmin(admin.ModelAdmin):
    list_display = ('title', 'brand', 'category', 'sub_category', 'price', 'discount', 'stock')
    list_filter = ('category', 'brand')
    search_fields = ('title', 'brand', 'search_name')
    readonly_fields = ('search_name', 'discount_price')


class OrderItemInline(admin.TabularInline):
    model = OrderItem
    extra = 0
    # An order's lines are a frozen record; editing them would rewrite history.
    readonly_fields = ('product_id', 'title', 'image', 'price', 'quantity', 'discount')
    can_delete = False


@admin.register(Order)
class OrderAdmin(admin.ModelAdmin):
    list_display = ('order_id', 'user_email', 'total', 'status', 'payment_status', 'created_at')
    list_filter = ('status', 'payment_status', 'payment_method')
    search_fields = ('order_id', 'user_email')
    inlines = [OrderItemInline]
    readonly_fields = ('order_id', 'sub_total', 'gst', 'shipping', 'total', 'address')


admin.site.register([Address, CartItem, WishlistItem, SavedLaterItem])
