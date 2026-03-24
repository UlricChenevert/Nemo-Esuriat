using Microsoft.Extensions.FileProviders;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddControllers();

var app = builder.Build();
app.UseDefaultFiles();

app.MapControllers();

// app.UseHttpsRedirection();

app.UseRouting();
app.UseStaticFiles(); 

if (app.Environment.IsDevelopment())
{
    app.UseStaticFiles(new StaticFileOptions
    {
        FileProvider = new PhysicalFileProvider(
            Path.Combine(builder.Environment.ContentRootPath, "Client", "HTML")),
        RequestPath = "/HTML",
        OnPrepareResponse = ctx =>
        {
            ctx.Context.Response.Headers.CacheControl = "no-cache, no-store, must-revalidate";
        }
    });
}

app.MapFallbackToController("Index", "Home");

app.Run();
