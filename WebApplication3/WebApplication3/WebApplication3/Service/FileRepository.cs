using Microsoft.EntityFrameworkCore;
using System.Collections.Generic;
using System.Threading.Tasks;
using WebApplication3.Data;
using WebApplication3.Models;

namespace WebApplication3.Repositories
{
    public interface IFileRepository
    {
        Task<UploadFile> AddAsync(UploadFile fileMetadata);
        Task<IEnumerable<UploadFile>> GetAllAsync();
        Task<UploadFile?> GetByIdAsync(int id);
    }

    public class FileRepository : IFileRepository
    {
        private readonly ApplicationDbContext _context;

        public FileRepository(ApplicationDbContext context)
        {
            _context = context;
        }

        public async Task<UploadFile> AddAsync(UploadFile fileMetadata)
        {
            _context.UploadFiles.Add(fileMetadata);
            await _context.SaveChangesAsync();
            return fileMetadata;
        }

        public async Task<IEnumerable<UploadFile>> GetAllAsync()
        {
            return await _context.UploadFiles.ToListAsync();
        }

        public async Task<UploadFile?> GetByIdAsync(int id)
        {
            return await _context.UploadFiles.FindAsync(id);
        }

        public async Task<bool> DeleteFileAsync(int id)
        {
            var file = await _context.UploadFiles.FindAsync(id);
            if (file == null)
                return false;

            _context.UploadFiles.Remove(file);
            await _context.SaveChangesAsync();
            return true;
        }
    }

}
