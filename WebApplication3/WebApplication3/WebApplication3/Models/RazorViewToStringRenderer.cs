using Microsoft.AspNetCore.Mvc.Rendering;
using Microsoft.AspNetCore.Mvc.ViewEngines;
using Microsoft.AspNetCore.Mvc.ViewFeatures;
using Microsoft.AspNetCore.Mvc;
using System.IO;
using System.Threading.Tasks;
using System;
using System.Linq;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Routing;
using Microsoft.AspNetCore.Mvc.Abstractions;
using Microsoft.AspNetCore.Mvc.ModelBinding;
using Microsoft.AspNetCore.Mvc.Razor;
using Microsoft.AspNetCore.Mvc.Routing;

public class RazorViewToStringRenderer
{
    private readonly IRazorViewEngine _viewEngine;
    private readonly ITempDataProvider _tempDataProvider;
    private readonly IServiceProvider _serviceProvider;
    private readonly IUrlHelperFactory _urlHelperFactory;
    private readonly LinkGenerator _linkGenerator;

    public RazorViewToStringRenderer(
        IRazorViewEngine viewEngine,
        ITempDataProvider tempDataProvider,
        IServiceProvider serviceProvider,
        IUrlHelperFactory urlHelperFactory,
        LinkGenerator linkGenerator)
    {
        _viewEngine = viewEngine;
        _tempDataProvider = tempDataProvider;
        _serviceProvider = serviceProvider;
        _urlHelperFactory = urlHelperFactory;
        _linkGenerator = linkGenerator;
    }

    public async Task<string> RenderViewToStringAsync<TModel>(string viewName, TModel model)
    {
        return await RenderViewToStringAsync(viewName, model, new ViewDataDictionary<TModel>(new EmptyModelMetadataProvider(), new ModelStateDictionary()));
    }

    public async Task<string> RenderViewToStringAsync<TModel>(string viewName, TModel model, ViewDataDictionary viewData)
    {
        var actionContext = GetActionContext();
        var view = FindView(actionContext, viewName);

        using (var sw = new StringWriter())
        {
            var viewContext = new ViewContext(
                actionContext,
                view,
                viewData,
                new TempDataDictionary(actionContext.HttpContext, _tempDataProvider),
                sw,
                new HtmlHelperOptions()
            );

            viewContext.ViewData.Model = model;

            var urlHelper = _urlHelperFactory.GetUrlHelper(actionContext);
            viewContext.RouteData.Routers.Add(new LinkGeneratorRouter(_linkGenerator, actionContext.HttpContext));

            await view.RenderAsync(viewContext);
            return sw.ToString();
        }
    }

    private IView FindView(ActionContext actionContext, string viewName)
    {
        var getViewResult = _viewEngine.GetView(null, viewName, true);
        if (getViewResult.Success)
        {
            return getViewResult.View;
        }

        var findViewResult = _viewEngine.FindView(actionContext, viewName, true);
        if (findViewResult.Success)
        {
            return findViewResult.View;
        }

        var searchedLocations = getViewResult.SearchedLocations.Concat(findViewResult.SearchedLocations);
        var errorMessage = string.Join(
            Environment.NewLine,
            new[] { $"Unable to find view '{viewName}'. The following locations were searched:" }.Concat(searchedLocations));

        throw new InvalidOperationException(errorMessage);
    }

    private ActionContext GetActionContext()
    {
        var httpContext = new DefaultHttpContext { RequestServices = _serviceProvider };
        return new ActionContext(httpContext, new RouteData(), new ActionDescriptor());
    }

    private class LinkGeneratorRouter : IRouter
    {
        private readonly LinkGenerator _linkGenerator;
        private readonly HttpContext _httpContext;

        public LinkGeneratorRouter(LinkGenerator linkGenerator, HttpContext httpContext)
        {
            _linkGenerator = linkGenerator;
            _httpContext = httpContext;
        }

        public VirtualPathData? GetVirtualPath(VirtualPathContext context)
        {
            var path = _linkGenerator.GetPathByRouteValues(_httpContext, context.RouteName, context.Values);
            return path == null ? null : new VirtualPathData(this, path);
        }

        public Task RouteAsync(RouteContext context)
        {
            return Task.CompletedTask;
        }
    }
}
