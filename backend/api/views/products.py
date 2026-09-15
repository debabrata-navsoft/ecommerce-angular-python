from decimal import Decimal

from django.db.models import F, FloatField, Q
from django.db.models.functions import Cast, Coalesce
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import APIView

from ..exceptions import ApiError
from ..models import Product
from ..permissions import IsAdmin
from ..serializers import ProductSerializer, ProductWriteSerializer

SORTS = {
    'newest': ['-created_at'],
    'oldest': ['created_at'],
    'price-asc': ['discount_price'],
    'price-desc': ['-discount_price'],
    'discount': ['-discount'],
    'rating': ['-rating'],
}

MAX_LIMIT = 200
BEST_SELLER_LIMIT = 20


def _num(field):
    return Cast(Coalesce(F(field), Decimal('0')), FloatField())


# Score weights kept identical to those the original client-side ProductService applied
# after downloading the whole collection.
BEST_SELLER_SCORE = _num('sales') * 3.0 + _num('rating') * 2.0 + _num('discount') * 0.5
TRENDING_SCORE = _num('views') * 0.5 + _num('rating') * 1.5 + _num('discount') * 0.3


def build_filter(params) -> Q:
    q = Q()

    def slug(key):
        return str(params.get(key, '')).strip().lower()

    # `category` matches either level, mirroring getProductsByCategory(), which treated a
    # slug as a hit against category *or* subCategory.
    category = slug('category')
    if category and category != 'all':
        q &= Q(category=category) | Q(sub_category=category)

    if params.get('main'):
        q &= Q(category=slug('main'))
    if params.get('subCategory'):
        q &= Q(sub_category=slug('subCategory'))
    if params.get('brand'):
        q &= Q(brand=str(params['brand']).strip())
    if params.get('search'):
        q &= Q(search_name__icontains=slug('search'))
    if params.get('minDiscount'):
        q &= Q(discount__gte=Decimal(params['minDiscount']))
    if params.get('inStock') == 'true':
        q &= Q(stock__gt=0)
    if params.get('minPrice'):
        q &= Q(discount_price__gte=Decimal(params['minPrice']))
    if params.get('maxPrice'):
        q &= Q(discount_price__lte=Decimal(params['maxPrice']))

    return q


def read_paging(params) -> tuple[int, int]:
    try:
        page = max(1, int(params.get('page', 1)))
    except (TypeError, ValueError):
        page = 1

    try:
        raw = int(params.get('limit', 0))
    except (TypeError, ValueError):
        raw = 0

    # limit omitted or 0 means "everything" — the catalog page filters client-side.
    return page, min(raw, MAX_LIMIT) if raw > 0 else 0


def paginated(queryset, params, serializer_class) -> dict:
    page, limit = read_paging(params)
    total = queryset.count()

    rows = queryset[(page - 1) * limit : page * limit] if limit else queryset

    return {
        'items': serializer_class(rows, many=True).data,
        'total': total,
        'page': page if limit else 1,
        'limit': limit,
        'pages': (total + limit - 1) // limit if limit else 1,
    }


class ProductListView(APIView):
    def get(self, request):
        sort = SORTS.get(request.query_params.get('sort'), SORTS['newest'])
        queryset = Product.objects.filter(build_filter(request.query_params)).order_by(*sort)

        return Response(paginated(queryset, request.query_params, ProductSerializer))

    def post(self, request):
        self.permission_classes = [IsAdmin]
        self.check_permissions(request)

        payload = ProductWriteSerializer(data=request.data)
        payload.is_valid(raise_exception=True)

        product = Product.objects.create(**payload.to_model_fields())
        return Response({'product': ProductSerializer(product).data}, status=status.HTTP_201_CREATED)


class ProductDetailView(APIView):
    def get_object(self, product_id):
        product = Product.objects.filter(pk=product_id).first()
        if product is None:
            raise ApiError.not_found('Product not found')
        return product

    def get(self, request, product_id):
        # A single UPDATE rather than read-modify-write, so concurrent views cannot lose
        # a count.
        Product.objects.filter(pk=product_id).update(views=F('views') + 1)

        return Response({'product': ProductSerializer(self.get_object(product_id)).data})

    def patch(self, request, product_id):
        self.permission_classes = [IsAdmin]
        self.check_permissions(request)

        product = self.get_object(product_id)

        payload = ProductWriteSerializer(data=request.data, partial=True)
        payload.is_valid(raise_exception=True)

        for field, value in payload.to_model_fields().items():
            setattr(product, field, value)
        product.save()  # save() recomputes search_name and discount_price

        return Response({'product': ProductSerializer(product).data})

    def delete(self, request, product_id):
        self.permission_classes = [IsAdmin]
        self.check_permissions(request)

        self.get_object(product_id).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class BestSellersView(APIView):
    def get(self, request):
        rows = Product.objects.annotate(score=BEST_SELLER_SCORE).order_by('-score', 'id')[
            :BEST_SELLER_LIMIT
        ]
        return Response({'items': ProductSerializer(rows, many=True).data})


class TrendingView(APIView):
    def get(self, request):
        # Trending is explicitly "popular but not already a best seller", so the top 20 by
        # best-seller score are excluded before ranking by the trending weights.
        best = Product.objects.annotate(score=BEST_SELLER_SCORE).order_by('-score', 'id')[
            :BEST_SELLER_LIMIT
        ]
        rows = (
            Product.objects.exclude(pk__in=list(best.values_list('pk', flat=True)))
            .annotate(score=TRENDING_SCORE)
            .order_by('-score', 'id')
        )

        return Response({'items': ProductSerializer(rows, many=True).data})


class DiscountFeedView(APIView):
    min_discount = Decimal('50')

    def get(self, request):
        rows = Product.objects.filter(discount__gte=self.min_discount).order_by('-created_at')
        return Response({'items': ProductSerializer(rows, many=True).data})


class TodayDealsView(DiscountFeedView):
    min_discount = Decimal('70')


class DiscountedView(DiscountFeedView):
    min_discount = Decimal('50')
